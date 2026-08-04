import {
  extractNoodleMentionHandles,
  PROFESSOR_MARI_ID,
  type NoodleAccount,
  type NoodleAccountProfileSettings,
  type NoodleBootstrap,
  type NoodleInteractionType,
  type NoodleSettings,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createNoodleStorage, parseNoodleAvatarCrop } from "../storage/noodle.storage.js";
import { isNoodleProfileGenerated } from "./noodle-profile-selection.js";
import { ensureAmbientNoodleAccounts } from "./noodle-ambient-profiles.js";

const PROFESSOR_MARI_NOODLE_BIO =
  "She/Her | 18+ | Skill Issue | Your Assistant After Hours (hey, I get to do fun stuff, too!) | Simp for Il Dottore 24/7 | LLMs Fan";

export function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function characterAvatarCrop(row: { data: unknown }) {
  return parseNoodleAvatarCrop(parseRecord(parseRecord(row.data).extensions).avatarCrop);
}

export function characterNameFromRow(row: { data: unknown } | null | undefined) {
  const data = parseRecord(row?.data);
  return typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Character";
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function mentionedCharacterAccounts(accounts: NoodleAccount[], content: string): NoodleAccount[] {
  const mentionedHandles = new Set(extractNoodleMentionHandles(content));
  if (mentionedHandles.size === 0) return [];
  return accounts.filter(
    (account) => account.kind === "character" && mentionedHandles.has(account.handle.toLowerCase()),
  );
}

export function mentionedAccountMetadata(accounts: NoodleAccount[]) {
  return {
    mentionedAccountIds: accounts.map((account) => account.id),
    mentionedEntityIds: accounts.map((account) => account.entityId),
  };
}

export function generatedProfileSettings(location: string, bannerUrl: string | null): NoodleAccountProfileSettings {
  return {
    profileGenerated: true,
    location,
    bannerUrl: bannerUrl ?? "",
  };
}

export async function ensureProfessorMariAccount(
  noodle: ReturnType<typeof createNoodleStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
) {
  const row = await characters.getById(PROFESSOR_MARI_ID);
  const account = await noodle.upsertAccountFromProfile({
    kind: "character",
    entityId: PROFESSOR_MARI_ID,
    displayName: row ? characterNameFromRow(row) : "Professor Mari",
    avatarUrl: row?.avatarPath ?? "/sprites/mari/Mari_profile.png",
    avatarCrop: row ? characterAvatarCrop(row) : null,
    bio: PROFESSOR_MARI_NOODLE_BIO,
    invited: true,
    syncIdentity: true,
  });
  if (
    account.settings.profile.profileManuallyEdited !== true &&
    (account.bio !== PROFESSOR_MARI_NOODLE_BIO ||
      !isNoodleProfileGenerated(account) ||
      !account.settings.profile.location)
  ) {
    await noodle.updateAccountProfile(account.id, {
      handle: account.handle || "professor_mari",
      displayName: account.displayName || "Professor Mari",
      bio: PROFESSOR_MARI_NOODLE_BIO,
      avatarUrl: account.avatarUrl || row?.avatarPath || "/sprites/mari/Mari_profile.png",
      profile: generatedProfileSettings("Marinara Engine", null),
    });
  }
}

export async function ensurePersonaAccounts(
  noodle: ReturnType<typeof createNoodleStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
) {
  const personas = await characters.listPersonas();
  const livePersonaIds = new Set<string>();
  for (const persona of personas) {
    livePersonaIds.add(persona.id);
    await noodle.upsertAccountFromProfile({
      kind: "persona",
      entityId: persona.id,
      displayName: persona.convoDisplayName || persona.name || "User",
      avatarUrl: persona.avatarPath ?? null,
      avatarCrop: parseNoodleAvatarCrop(persona.avatarCrop),
      bio: persona.aboutMe || persona.description || "",
      invited: true,
    });
  }
  return livePersonaIds;
}

function filterStalePersonaAccounts(bootstrap: NoodleBootstrap, livePersonaIds: Set<string>): NoodleBootstrap {
  return {
    ...bootstrap,
    accounts: bootstrap.accounts.filter(
      (account) => account.kind !== "persona" || livePersonaIds.has(account.entityId),
    ),
  };
}

function filterExcludedNoodleAccounts(bootstrap: NoodleBootstrap, settings: NoodleSettings): NoodleBootstrap {
  if (settings.allowProfessorMari) return bootstrap;
  return {
    ...bootstrap,
    accounts: bootstrap.accounts.filter(
      (account) => account.kind !== "character" || account.entityId !== PROFESSOR_MARI_ID,
    ),
  };
}

export async function bootstrapVisibleNoodle(
  noodle: ReturnType<typeof createNoodleStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
) {
  const settings = await noodle.getSettings();
  const livePersonaIds = await ensurePersonaAccounts(noodle, characters);
  await ensureAmbientNoodleAccounts(noodle, settings.allowRandomUsers);
  if (settings.allowProfessorMari) await ensureProfessorMariAccount(noodle, characters);
  const existingCharacterAccounts = (await noodle.listAccounts()).filter(
    (account) => account.kind === "character" && account.entityId !== PROFESSOR_MARI_ID,
  );
  const characterRowsById = new Map((await characters.list()).map((row) => [row.id, row]));
  for (const account of existingCharacterAccounts) {
    const row = characterRowsById.get(account.entityId);
    if (!row) {
      // Character was deleted but the account cleanup failed or predates it existing (see
      // characters.routes.ts delete handler) — reconcile the ghost here on every open.
      try {
        await noodle.deleteAccountByEntity("character", account.entityId);
      } catch (err) {
        logger.error(err, "Failed to reconcile ghost Noodle account for character %s", account.entityId);
      }
      continue;
    }
    await noodle.upsertAccountFromProfile({
      kind: "character",
      entityId: row.id,
      displayName: characterNameFromRow(row),
      avatarUrl: row.avatarPath ?? null,
      avatarCrop: characterAvatarCrop(row),
      syncIdentity: true,
    });
  }
  return filterExcludedNoodleAccounts(filterStalePersonaAccounts(await noodle.bootstrap(), livePersonaIds), settings);
}

export async function resolvePersonaAccount(
  noodle: ReturnType<typeof createNoodleStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
  personaId?: string,
) {
  const personas = await characters.listPersonas();
  const persona =
    personas.find((p) => p.id === personaId) ?? personas.find((p) => p.isActive === "true") ?? personas[0];
  if (!persona) return null;
  return noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: persona.id,
    displayName: persona.convoDisplayName || persona.name || "User",
    avatarUrl: persona.avatarPath ?? null,
    avatarCrop: parseNoodleAvatarCrop(persona.avatarCrop),
    bio: persona.aboutMe || persona.description || "",
    invited: true,
  });
}

export function interactionDigestVerb(type: NoodleInteractionType) {
  if (type === "reply") return "replied on";
  if (type === "repost") return "reposted";
  if (type === "vote") return "voted in";
  return "liked";
}

export function noodleDigestAccountLabel(account: Pick<NoodleAccount, "kind" | "displayName" | "handle">) {
  const identity = `${account.displayName} (@${account.handle})`;
  return account.kind === "persona" ? `Persona ${identity}` : identity;
}

/**
 * Drops character accounts whose character card no longer exists.
 *
 * A Noodle account stores its own name and handle, so a stale account keeps rendering in the
 * "Active Noodle Accounts" list while `characters.getById` returns null for it. The refresh prompt
 * then carries the name with no character card, and the lorebook scan is scoped to a character ID
 * that cannot match anything — every character and lore detail silently disappears from generation
 * with no error. Accounts are left in place (posts still reference them); they are only skipped
 * when choosing who takes part in a refresh.
 *
 * Accounts go stale whenever a character's row stops matching the stored entityId: deleting the
 * character (`characters.remove` does not touch noodle_accounts, and there is no cascade), or any
 * re-create path that mints a fresh ID, such as a profile import (`characters.create` calls newId).
 */
export async function filterResolvableNoodleParticipants(
  accounts: NoodleAccount[],
  characters: ReturnType<typeof createCharactersStorage>,
): Promise<{ resolvable: NoodleAccount[]; staleAccounts: NoodleAccount[] }> {
  const resolvable: NoodleAccount[] = [];
  const staleAccounts: NoodleAccount[] = [];
  for (const account of accounts) {
    if (account.kind !== "character") {
      resolvable.push(account);
      continue;
    }
    if (await characters.getById(account.entityId)) resolvable.push(account);
    else staleAccounts.push(account);
  }
  return { resolvable, staleAccounts };
}
