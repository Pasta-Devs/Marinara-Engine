import { normalizeTextForMatch, type AvatarCrop } from "@marinara-engine/shared";

export type SpeakerAvatarEntry = {
  url: string;
  crop?: AvatarCrop | null;
  nameColor?: string;
  dialogueColor?: string;
};

export type SpeakerAvatarCandidate = {
  name: string;
  avatarUrl?: string | null;
  avatarCrop?: AvatarCrop | null;
};

/** Add only uniquely identified, rendered speakers from the library. */
export function addUniqueLibrarySpeakerAvatars(
  target: Map<string, SpeakerAvatarEntry>,
  speakerNames: Iterable<string>,
  candidates: readonly SpeakerAvatarCandidate[],
  protectedNames: Iterable<string> = [],
): void {
  const protectedKeys = new Set(Array.from(protectedNames, normalizeTextForMatch));
  for (const speakerName of speakerNames) {
    const key = normalizeTextForMatch(speakerName);
    if (!key || target.has(key) || protectedKeys.has(key)) continue;
    const matches = candidates.filter((candidate) => normalizeTextForMatch(candidate.name) === key);
    if (matches.length !== 1 || !matches[0]?.avatarUrl) continue;
    target.set(key, { url: matches[0].avatarUrl, crop: matches[0].avatarCrop ?? null });
  }
}
