import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import type { CustomVoiceProfile, ManagedCustomVoice } from "@marinara-engine/shared";
import { getDataDir } from "../../utils/data-dir.js";

export interface CustomVoiceState {
  snapshot: string;
  profile: CustomVoiceProfile;
  voices: ManagedCustomVoice[];
}
// Deliberately outside the file-store tables and backup/share asset allowlists.
// No recordings, transcripts, consent data, endpoints or credentials are stored.
export function customVoiceStorage(connectionId: string) {
  const dir = join(getDataDir(), "custom-voices");
  const file = join(
    dir,
    `${createHash("sha256")
      .update(connectionId || "legacy")
      .digest("hex")}.json`,
  );
  return {
    async read(): Promise<CustomVoiceState | null> {
      try {
        return JSON.parse(await readFile(file, "utf8")) as CustomVoiceState;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async write(state: CustomVoiceState): Promise<void> {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
        await rename(temporary, file);
      } finally {
        await rm(temporary, { force: true });
      }
    },
  };
}
/** Ownership comes only from persisted registration records, never a name prefix. */
export async function isKnownManagedVoice(id: string): Promise<boolean> {
  const dir = join(getDataDir(), "custom-voices");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  for (const file of files.filter((name) => /^[a-f0-9]{64}\.json$/.test(name))) {
    const state = JSON.parse(await readFile(join(dir, file), "utf8")) as CustomVoiceState;
    if (state.voices.some((voice) => voice.id === id)) return true;
  }
  return false;
}
const locks = new Map<string, Promise<unknown>>();
export async function withCustomVoiceLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}
