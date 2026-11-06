// Shared setup for the `*-handbook.regression.ts` files: a temp storage dir, the shipped handbook, its
// worked-example `{"action":…}` lines, and a MariDbService on a fresh file-backed database. Every env var
// it sets is restored and the temp dir removed afterwards. Not a regression itself (the runner only
// discovers `*.regression.ts`).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- example lines and outputs are probed field by field */
export type HandbookCommand = { action: string; apply?: boolean; [key: string]: any };
export type HandbookResult = {
  ok?: boolean;
  mode?: string;
  error?: string;
  output?: any;
  readBack?: { status?: string };
  approval?: { status?: string };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

type Db = Awaited<
  ReturnType<(typeof import("../../../packages/server/src/db/file-backed-store.js"))["createFileNativeDB"]>
>;

export type HandbookContext = {
  skill: { id: string; content: string };
  /** Every `{"action"…}` line of the handbook, in order. */
  commands: HandbookCommand[];
  db: Db;
  mari: MariDbService;
  /** Runs the example line at `index`. */
  run: (index: number) => Promise<HandbookResult>;
};

export async function withHandbook(
  skillId: string,
  body: (context: HandbookContext) => Promise<void>,
  options: { dataDir?: boolean } = {},
): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), `marinara-${skillId}-`));
  const saved = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
  try {
    if (options.dataDir) process.env.DATA_DIR = dir;
    process.env.FILE_STORAGE_DIR = options.dataDir ? join(dir, "storage") : dir;
    // Imported after the env is set: the server modules may read it at load time.
    const { loadBuiltinSkills } =
      await import("../../../packages/server/src/services/professor-mari/builtin-skills.js");
    const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
    const { MariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");

    const { skills } = await loadBuiltinSkills();
    const skill = skills.find((entry) => entry.id === skillId);
    assert.ok(skill, `${skillId} ships with the app`);
    const commands = skill.content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith('{"action"'))
      .map((line) => JSON.parse(line) as HandbookCommand);
    for (const command of commands) assert.equal(typeof command.action, "string", "every example line has an action");

    const db = await createFileNativeDB();
    try {
      const mari = new MariDbService(db);
      const run = async (index: number) => (await mari.executeAction(commands[index]!)) as HandbookResult;
      await body({ skill, commands, db, mari, run });
    } finally {
      await db._fileStore.close();
    }
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
}
