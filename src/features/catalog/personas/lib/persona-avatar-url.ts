import { avatarFileUrlFromPath } from "../../../../shared/api/local-file-api";

export type PersonaAvatarSource = {
  avatarPath?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
};

export function personaAvatarUrl(source: PersonaAvatarSource | null | undefined): string | null {
  if (!source) return null;
  return avatarFileUrlFromPath(source.avatarFilename, source.avatarFilePath) ?? source.avatarPath ?? null;
}
