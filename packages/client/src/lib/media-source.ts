import {
  AUDIO_SOURCE_OPTIONS,
  IMAGE_GENERATION_SOURCES,
  inferImageSource,
  inferVideoSource,
  VIDEO_GENERATION_SOURCES,
} from "@marinara-engine/shared";
import type { CreateConnectionPayload } from "../hooks/use-connections";
import {
  IMAGE_VENDOR,
  MEDIA_BACKENDS,
  SPEECH_SOURCE,
  VIDEO_SOURCE_VENDOR,
} from "../components/modals/create-connection/shared";

type MediaSourceRow = {
  provider?: string | null;
  imageGenerationSource?: string | null;
  imageService?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  model?: string | null;
  baseUrl?: string | null;
};

export function rowUsesMediaSource(row: MediaSourceRow, source: string) {
  return (
    (row.provider === "image_generation" &&
      (row.imageGenerationSource || row.imageService || inferImageSource(row.model ?? "", row.baseUrl ?? "")) ===
        source) ||
    (row.provider === "video_generation" &&
      (row.videoGenerationSource || row.videoService || inferVideoSource(row.model ?? "", row.baseUrl ?? "")) ===
        source)
  );
}

export type MediaKind = "image" | "video" | "audio";

/** The media sources an account's provider can drive for one kind, its own first. */
export function mediaSources(provider: string, kind: MediaKind): string[] {
  if (kind === "audio")
    return [
      SPEECH_SOURCE[provider as keyof typeof SPEECH_SOURCE] ??
        MEDIA_BACKENDS.find((backend) => backend.id === `audio:${provider}`)?.source,
    ].filter((source): source is string => !!source);
  if (kind === "image")
    return [
      ...Object.entries(IMAGE_VENDOR)
        .filter(([, vendor]) => vendor === provider)
        .map(([source]) => source),
      ...MEDIA_BACKENDS.filter((backend) => backend.source === provider && backend.image).map(
        (backend) => backend.source,
      ),
      ...(provider === "custom" ? ["openai"] : []),
    ];
  return [
    ...Object.entries(VIDEO_SOURCE_VENDOR)
      .filter(([, vendor]) => vendor === provider)
      .map(([source]) => source),
    ...MEDIA_BACKENDS.filter((backend) => backend.source === provider && backend.video).map(
      (backend) => backend.source,
    ),
  ];
}

type Account = { id: string; provider: string; baseUrl?: string | null };
type Row = MediaSourceRow & { id: string; accountId?: string | null; audioSource?: string | null };

/**
 * The image, video or voice row that runs one catalog model of an account: an existing one, else a
 * new row under the account. Undefined when the account's provider drives no source of that kind.
 */
export async function mediaRowFor(
  kind: MediaKind,
  account: Account,
  model: string,
  name: string | undefined,
  rows: readonly Row[],
  createRow: (data: CreateConnectionPayload) => Promise<unknown>,
): Promise<string | undefined> {
  const source = mediaSources(account.provider, kind)[0];
  if (!source) return undefined;
  const provider = kind === "image" ? "image_generation" : kind === "video" ? "video_generation" : "audio";
  const existing = rows.find(
    (row) =>
      row.provider === provider &&
      row.accountId === account.id &&
      row.model === model &&
      (kind === "audio" ? row.audioSource === source : rowUsesMediaSource(row, source)),
  );
  if (existing) return existing.id;
  const sourceDef = (kind === "image" ? IMAGE_GENERATION_SOURCES : VIDEO_GENERATION_SOURCES).find(
    (candidate) => candidate.id === source,
  );
  const baseUrl =
    account.provider === "custom" ||
    account.provider === "linkapi" ||
    MEDIA_BACKENDS.some((backend) => backend.source === source)
      ? (account.baseUrl ?? "")
      : (sourceDef?.defaultBaseUrl ??
        AUDIO_SOURCE_OPTIONS.find((option) => option.id === source)?.defaultBaseUrl ??
        account.baseUrl ??
        "");
  const voice = AUDIO_SOURCE_OPTIONS.find((option) => option.id === source)?.defaultVoice;
  const created = (await createRow({
    name: name ?? model,
    provider,
    apiKey: "",
    accountId: account.id,
    baseUrl,
    model,
    ...(kind === "image" ? { imageGenerationSource: source, imageService: source } : {}),
    ...(kind === "video" ? { videoGenerationSource: source, videoService: source } : {}),
    ...(kind === "audio" ? { audioSource: source, ...(voice ? { audioVoice: voice } : {}) } : {}),
  } as CreateConnectionPayload)) as { id?: string };
  return created.id;
}
