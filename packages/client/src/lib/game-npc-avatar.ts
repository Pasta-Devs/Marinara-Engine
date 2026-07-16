import { normalizeTextForMatch } from "@marinara-engine/shared";

const NPC_AVATAR_REVISION_PARAM = "mariAvatarRevision";
const TRAILING_NPC_REPUTATION_LABEL = /(?:^|[\s_-])(?:devoted|allied|friendly|neutral|unfriendly|hostile|enemy)$/i;
let npcAvatarRevision = 0;

export function cleanNpcAvatarDisplayName(value: string): string {
  return value.replace(TRAILING_NPC_REPUTATION_LABEL, "").trim() || value;
}

export function normalizeNpcAvatarName(value: string): string {
  return normalizeTextForMatch(cleanNpcAvatarDisplayName(value).replace(/[_-]+/g, " "));
}

function splitHash(value: string): { base: string; hash: string } {
  const hashIndex = value.indexOf("#");
  return hashIndex === -1
    ? { base: value, hash: "" }
    : { base: value.slice(0, hashIndex), hash: value.slice(hashIndex) };
}

export function withoutNpcAvatarRevision(value: string): string {
  const { base, hash } = splitHash(value);
  const [pathname, query = ""] = base.split("?", 2);
  const params = new URLSearchParams(query);
  params.delete(NPC_AVATAR_REVISION_PARAM);
  const nextQuery = params.toString();
  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash}`;
}

export function isSameNpcAvatarResource(left: string, right: string): boolean {
  return withoutNpcAvatarRevision(left) === withoutNpcAvatarRevision(right);
}

/**
 * Force browsers to refetch an NPC portrait after the server replaces the
 * image at a stable path. The persisted resource identity remains intact.
 */
export function withFreshNpcAvatarRevision(value: string): string {
  const { base, hash } = splitHash(withoutNpcAvatarRevision(value));
  const separator = base.includes("?") ? "&" : "?";
  npcAvatarRevision += 1;
  return `${base}${separator}${NPC_AVATAR_REVISION_PARAM}=${Date.now()}-${npcAvatarRevision}${hash}`;
}
