import { avatarFileUrlFromPath } from "../../../../shared/api/local-file-api";

export type CharacterAvatarSource = {
  avatarPath?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
};

export function characterAvatarUrl(source: CharacterAvatarSource | null | undefined): string | null {
  if (!source) return null;
  return avatarFileUrlFromPath(source.avatarFilename, source.avatarFilePath) ?? source.avatarPath ?? null;
}
