/**
 * The AI reasons log for lab runs (Alyssa 2026-11-03: the Debug AI reasons log MUST be on for ALL
 * playtesting, sims and balance measurements; a run without it is invalid). Every Engine AI pick in a
 * Classic or Tactical Marinara fight is kept on `s.marinara.aiReasons` whatever the caller does; this
 * writes them out after each fight, always, as gzip members appended to one file per run:
 *
 *   REASON_LOG=<dir>   default /mnt/project-files/playtest/reasons (falls back to ./reasons-logs)
 *   read with: zcat <file>.jsonl.gz
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { CombatDirectorState } from "../../packages/server/src/services/game/combat-director.service.js";

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
let target: string | undefined;

function file(script: string): string {
  if (target) return target;
  for (const dir of [process.env.REASON_LOG, "/mnt/project-files/playtest/reasons", "reasons-logs"]) {
    if (!dir) continue;
    try {
      mkdirSync(dir, { recursive: true });
      target = join(dir, `${script}-${stamp}.jsonl.gz`);
      console.error(`[reasons] AI reasons log: ${target}`);
      return target;
    } catch {
      // next
    }
  }
  throw new Error("No writable directory for the AI reasons log; set REASON_LOG.");
}

/** Writes one fight's AI reasons (and its outcome) to the run's reasons log. */
export function keepFightReasons(script: string, fight: string, s: CombatDirectorState): void {
  const reasons = s.marinara?.aiReasons ?? [];
  const line = JSON.stringify({ fight, outcome: s.outcome ?? null, rounds: s.round, reasons }) + "\n";
  appendFileSync(file(script), gzipSync(line));
}
