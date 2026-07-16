import type {
  ConversationCallCharacterVideoClipKind,
  ConversationCallCharacterVideoManifest,
  VideoGenerationUserSettings,
} from "@marinara-engine/shared";
import { getCapabilityService } from "../capability-packages/capability-service-registry.service.js";
import type { PromptOverridesStorage } from "../storage/prompt-overrides.storage.js";

type VideoGenerationConnection = {
  id: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  defaultParameters?: string | null;
};

type BaseVideoInput = {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
};

type GenerationInput = BaseVideoInput & {
  connection: VideoGenerationConnection;
  promptOverridesStorage: PromptOverridesStorage;
  videoSettings?: VideoGenerationUserSettings | null;
  debugMode?: boolean;
  includeAvatarReference?: boolean;
  fallback?: unknown;
};

interface CharacterVideoService {
  getConversationCallCharacterVideoManifest(input: BaseVideoInput): Promise<ConversationCallCharacterVideoManifest>;
  startConversationCallCharacterVideoGeneration(
    input: GenerationInput & { clipKinds?: ConversationCallCharacterVideoClipKind[] | null },
  ): Promise<ConversationCallCharacterVideoManifest>;
  startConversationCallCustomVideoClipGeneration(
    input: GenerationInput & { label?: string | null; prompt: string },
  ): Promise<ConversationCallCharacterVideoManifest>;
  uploadConversationCallCharacterVideoClip(
    input: BaseVideoInput & {
      buffer: Buffer;
      label?: string | null;
      kind?: ConversationCallCharacterVideoClipKind | null;
    },
  ): Promise<ConversationCallCharacterVideoManifest>;
  updateConversationCallCharacterVideoClipTrim(
    input: BaseVideoInput & {
      kind: ConversationCallCharacterVideoClipKind;
      trimStartSeconds?: unknown;
      trimEndSeconds?: unknown;
    },
  ): Promise<ConversationCallCharacterVideoManifest>;
  updateConversationCallCustomVideoClipTrim(
    input: BaseVideoInput & { clipId: string; trimStartSeconds?: unknown; trimEndSeconds?: unknown },
  ): Promise<ConversationCallCharacterVideoManifest>;
  deleteConversationCallCharacterVideoClip(
    input: BaseVideoInput & { kind: ConversationCallCharacterVideoClipKind },
  ): Promise<boolean>;
  deleteConversationCallCustomVideoClip(input: BaseVideoInput & { clipId: string }): Promise<boolean>;
  getConversationCallCharacterVideoFile(
    characterId: string,
    kind: ConversationCallCharacterVideoClipKind,
  ): string | null;
  getConversationCallCustomVideoClipFile(characterId: string, clipId: string): string | null;
}

const provider = () => getCapabilityService<CharacterVideoService>("conversation-calls:character-videos");

function matchesNamedError(value: unknown, name: string): boolean {
  return value instanceof Error && value.name === name;
}

export class ConversationCallVideoGenerationInProgressError extends Error {
  readonly name = "ConversationCallVideoGenerationInProgressError";
  static [Symbol.hasInstance](value: unknown) {
    return matchesNamedError(value, "ConversationCallVideoGenerationInProgressError");
  }
}

export class ConversationCallVideoClipNotFoundError extends Error {
  readonly name = "ConversationCallVideoClipNotFoundError";
  static [Symbol.hasInstance](value: unknown) {
    return matchesNamedError(value, "ConversationCallVideoClipNotFoundError");
  }
}

export class ConversationCallVideoClipTrimError extends Error {
  readonly name = "ConversationCallVideoClipTrimError";
  static [Symbol.hasInstance](value: unknown) {
    return matchesNamedError(value, "ConversationCallVideoClipTrimError");
  }
}

export class ConversationCallVideoClipAvatarMismatchError extends Error {
  readonly name = "ConversationCallVideoClipAvatarMismatchError";
  static [Symbol.hasInstance](value: unknown) {
    return matchesNamedError(value, "ConversationCallVideoClipAvatarMismatchError");
  }
}

export class ConversationCallVideoClipUploadError extends Error {
  readonly name = "ConversationCallVideoClipUploadError";
  static [Symbol.hasInstance](value: unknown) {
    return matchesNamedError(value, "ConversationCallVideoClipUploadError");
  }
}

function requireProvider(): CharacterVideoService {
  const service = provider();
  if (!service) throw new Error("Calls is not installed or active");
  return service;
}

export async function getConversationCallCharacterVideoManifest(
  input: BaseVideoInput,
): Promise<ConversationCallCharacterVideoManifest> {
  return (
    (await provider()?.getConversationCallCharacterVideoManifest(input)) ?? {
      characterId: input.characterId,
      characterName: input.characterName,
      sourceAvatarPath: input.avatarPath,
      generating: false,
      updatedAt: null,
      clips: [],
      customClips: [],
    }
  );
}

export function startConversationCallCharacterVideoGeneration(
  input: GenerationInput & { clipKinds?: ConversationCallCharacterVideoClipKind[] | null },
) {
  return requireProvider().startConversationCallCharacterVideoGeneration(input);
}

export function startConversationCallCustomVideoClipGeneration(
  input: GenerationInput & { label?: string | null; prompt: string },
) {
  return requireProvider().startConversationCallCustomVideoClipGeneration(input);
}

export function uploadConversationCallCharacterVideoClip(
  input: BaseVideoInput & {
    buffer: Buffer;
    label?: string | null;
    kind?: ConversationCallCharacterVideoClipKind | null;
  },
) {
  return requireProvider().uploadConversationCallCharacterVideoClip(input);
}

export function updateConversationCallCharacterVideoClipTrim(
  input: BaseVideoInput & {
    kind: ConversationCallCharacterVideoClipKind;
    trimStartSeconds?: unknown;
    trimEndSeconds?: unknown;
  },
) {
  return requireProvider().updateConversationCallCharacterVideoClipTrim(input);
}

export function updateConversationCallCustomVideoClipTrim(
  input: BaseVideoInput & { clipId: string; trimStartSeconds?: unknown; trimEndSeconds?: unknown },
) {
  return requireProvider().updateConversationCallCustomVideoClipTrim(input);
}

export function deleteConversationCallCharacterVideoClip(
  input: BaseVideoInput & { kind: ConversationCallCharacterVideoClipKind },
) {
  return requireProvider().deleteConversationCallCharacterVideoClip(input);
}

export function deleteConversationCallCustomVideoClip(input: BaseVideoInput & { clipId: string }) {
  return requireProvider().deleteConversationCallCustomVideoClip(input);
}

export function getConversationCallCharacterVideoFile(
  characterId: string,
  kind: ConversationCallCharacterVideoClipKind,
) {
  return provider()?.getConversationCallCharacterVideoFile(characterId, kind) ?? null;
}

export function getConversationCallCustomVideoClipFile(characterId: string, clipId: string) {
  return provider()?.getConversationCallCustomVideoClipFile(characterId, clipId) ?? null;
}
