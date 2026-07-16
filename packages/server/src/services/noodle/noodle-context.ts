// ──────────────────────────────────────────────
// Noodle Prompt Context
// ──────────────────────────────────────────────
import {
  PROFESSOR_MARI_ID,
  type ChatMode,
  type NoodleCarryoverTarget,
  type NoodleDigestEntry,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { wrapContent } from "../prompt/format-engine.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";

export const NOODLE_CARRYOVER_TOKEN_BUDGET = 8192;
const NOODLE_CARRYOVER_CHARACTER_BUDGET = NOODLE_CARRYOVER_TOKEN_BUDGET * 4;
const NOODLE_DIGEST_CONTENT_LIMIT = 1200;

function sinceHoursIso(hours: number) {
  return new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000).toISOString();
}

function modeAllowed(carryoverModes: readonly NoodleCarryoverTarget[], chatMode: ChatMode) {
  if (carryoverModes.includes("conversation") && chatMode === "conversation") return true;
  if (carryoverModes.includes("roleplay") && (chatMode === "roleplay" || chatMode === "visual_novel")) return true;
  if (carryoverModes.includes("game") && chatMode === "game") return true;
  return false;
}

/**
 * Keep the newest relevant digest entries, render them in chronological order, and hard-cap the
 * complete wrapped block using the same chars/4 estimate as lorebook prompt budgeting.
 */
export function buildNoodleCarryoverBlock(
  newestFirstDigests: readonly Pick<NoodleDigestEntry, "content">[],
  maxItems: number,
  wrapFormat: "xml" | "markdown" | "none",
): string | null {
  const selected: string[] = [];
  const itemLimit = Math.max(0, Math.floor(maxItems));
  const sampleWrappedLength = wrapContent("x", "Recent Social Media Activity", wrapFormat).length;
  const wrapperOverhead = sampleWrappedLength - 1;
  let bodyLength = 0;
  let nonEmptyLineCount = 0;
  for (const digest of newestFirstDigests.slice(0, itemLimit)) {
    const content = digest.content.trim().slice(0, NOODLE_DIGEST_CONTENT_LIMIT);
    if (!content) continue;
    const line = `- ${content}`;
    const renderedLineLength = selected.length === 0 ? line.trimEnd().length : line.length;
    const candidateBodyLength = bodyLength + (selected.length > 0 ? 1 : 0) + renderedLineLength;
    const candidateNonEmptyLineCount =
      nonEmptyLineCount + line.split("\n").filter((part) => part.trim().length > 0).length;
    const xmlIndentLength = wrapFormat === "xml" ? Math.max(0, candidateNonEmptyLineCount - 1) * 4 : 0;
    if (wrapperOverhead + candidateBodyLength + xmlIndentLength > NOODLE_CARRYOVER_CHARACTER_BUDGET) break;
    selected.push(content);
    bodyLength = candidateBodyLength;
    nonEmptyLineCount = candidateNonEmptyLineCount;
  }
  if (selected.length === 0) return null;
  const lines = selected
    .slice()
    .reverse()
    .map((content) => `- ${content}`);
  return wrapContent(lines.join("\n"), "Recent Social Media Activity", wrapFormat);
}

export async function buildRecentSocialMediaActivityBlock(input: {
  db: DB;
  chatMode: ChatMode;
  characterIds: string[];
  personaId: string | null;
  wrapFormat: "xml" | "markdown" | "none";
}): Promise<string | null> {
  const noodle = createNoodleStorage(input.db);
  const settings = await noodle.getSettings();
  if (!modeAllowed(settings.carryoverModes, input.chatMode)) return null;

  const accountIds = new Set<string>();
  const characterAccounts = await noodle.getAccountsByEntities("character", input.characterIds);
  for (const account of characterAccounts) {
    if (account.entityId === PROFESSOR_MARI_ID && !settings.allowProfessorMari) continue;
    if (account.invited) accountIds.add(account.id);
  }
  if (input.personaId) {
    const personaAccount = await noodle.getAccountByEntity("persona", input.personaId);
    if (personaAccount) accountIds.add(personaAccount.id);
  }
  if (accountIds.size === 0) return null;

  const digests = await noodle.listDigests({
    since: sinceHoursIso(settings.carryoverHours),
    limit: Math.max(settings.carryoverMaxItems * 4, 20),
  });
  const relevant = digests.filter((digest) => digest.accountIds.some((id) => accountIds.has(id)));
  return buildNoodleCarryoverBlock(relevant, settings.carryoverMaxItems, input.wrapFormat);
}
