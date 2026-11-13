// ──────────────────────────────────────────────
// Connection jobs — every job a Model can do, in display order. The Defaults box, the Add
// window's "For a job" list, the pickers and the model-row role badges all read this one table,
// so a new job or a changed rule is one edit here.
// ──────────────────────────────────────────────
import {
  BrainCircuit,
  Database,
  Eye,
  Film,
  GraduationCap,
  ImageIcon,
  MessageCircleQuestion,
  MessageSquareText,
  Mic,
  Sparkles,
  VenetianMask,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import {
  isChatProvider,
  type ConnectionPickerKind,
  type FeatureModelConnections,
  TTS_SOURCE_DEFAULTS,
  TTS_SOURCES,
  type TTSConfig,
  type TTSSource,
} from "@marinara-engine/shared";
import type { AddKind } from "./add-connection";
import { isConnectionFlagTrue } from "./connection-filters";
import type { RemoteConnectionModel } from "./connection-model-selection";
import type { MediaKind } from "./media-source";
import type { ConnectionModelRow } from "./connection-groups";

export type Job = {
  key: string;
  icon: LucideIcon;
  /** The heading it sits under behind the Defaults box's "All jobs". */
  group: "chat" | "omnibar" | "media" | "background";
  /** Always shown in the Defaults box. */
  primary?: true;
  /** Which Models fit: the picker filter and the Add window's kind. */
  kind?: Exclude<ConnectionPickerKind, "all">;
  /** The row flag that marks a Connection as this job's Model. */
  flag?: "isDefault" | "defaultForAgents";
  /** The row flag of its fallback Model; a job with one gets the default + fallback pickers. */
  fallback?: "fallbackForMain" | "fallbackForAgents";
  /** Set in the feature-model setting instead of a row flag. */
  feature?: keyof FeatureModelConnections;
  /** Where its "If it fails" Model is kept, for a feature-set job. */
  fallbackFeature?: keyof FeatureModelConnections;
  /** What answers while the feature is unset. */
  follows?: "agents" | "main" | "sidecar" | "off";
  /** A device service (Dictation) set up on its own screen. */
  device?: "stt";
  /** Not one of the Add window's job cards; "search" still lets its search find it. */
  add?: false | "search";
  /** More words the Add window's search matches. */
  terms?: string;
};

const JOB_LIST = [
  {
    key: "main",
    icon: MessageSquareText,
    group: "chat",
    primary: true,
    kind: "chat",
    flag: "isDefault",
    fallback: "fallbackForMain",
  },
  {
    key: "agents",
    icon: Sparkles,
    group: "chat",
    primary: true,
    kind: "chat",
    flag: "defaultForAgents",
    fallback: "fallbackForAgents",
  },
  {
    key: "impersonate",
    icon: VenetianMask,
    group: "chat",
    kind: "chat",
    feature: "impersonateConnectionId",
    fallbackFeature: "impersonateFallbackConnectionId",
    follows: "main",
    add: false,
  },
  {
    key: "mari",
    icon: GraduationCap,
    group: "omnibar",
    kind: "chat",
    feature: "mariConnectionId",
    fallbackFeature: "mariFallbackConnectionId",
    follows: "agents",
  },
  {
    key: "quick",
    icon: MessageCircleQuestion,
    group: "omnibar",
    kind: "chat",
    feature: "omnibarAsideConnectionId",
    fallbackFeature: "omnibarAsideFallbackConnectionId",
    follows: "sidecar",
    add: false,
  },
  {
    key: "images",
    icon: ImageIcon,
    group: "media",
    primary: true,
    kind: "image",
    flag: "defaultForAgents",
    fallback: "fallbackForAgents",
  },
  { key: "video", icon: Film, group: "media", kind: "video", flag: "defaultForAgents", fallback: "fallbackForAgents" },
  // Text to speech reads this audio default; ElevenLabs also makes the music and sound effects.
  {
    key: "voice",
    icon: Volume2,
    group: "media",
    kind: "audio",
    flag: "defaultForAgents",
    fallback: "fallbackForAgents",
    terms: "tts audio music sound effects",
  },
  { key: "stt", icon: Mic, group: "media", device: "stt", add: "search", terms: "stt whisper" },
  { key: "decision", icon: BrainCircuit, group: "background", kind: "decision", flag: "defaultForAgents" },
  { key: "embeddings", icon: Database, group: "background", kind: "chat" },
  {
    key: "vision",
    icon: Eye,
    group: "background",
    kind: "chat",
    feature: "visionConnectionId",
    fallbackFeature: "visionFallbackConnectionId",
    follows: "off",
  },
] as const satisfies readonly Job[];

export type JobKey = (typeof JOB_LIST)[number]["key"];
export const JOBS: readonly (Job & { key: JobKey })[] = JOB_LIST;
export const JOB = Object.fromEntries(JOBS.map((job) => [job.key, job])) as Record<JobKey, Job & { key: JobKey }>;

export const jobLabelKey = (job: Job) =>
  job.feature ? `connections.defaults.feature.${job.feature}` : `connections.defaults.role.${job.key}`;
/** The provider of each non-chat kind. */
export const KIND_PROVIDER = {
  image: "image_generation",
  video: "video_generation",
  audio: "audio",
  decision: "decision",
} as const;
/** The Add window's filter for a picker kind. */
export const ADD_KIND: Record<ConnectionPickerKind, AddKind | undefined> = {
  chat: "chat",
  image: "image",
  video: "video",
  audio: "voice",
  decision: "decision",
  all: undefined,
};

export function matchesKind(row: Pick<ConnectionModelRow, "provider">, kind: ConnectionPickerKind) {
  if (kind === "all") return true;
  return kind === "chat" ? isChatProvider(row.provider) : row.provider === KIND_PROVIDER[kind];
}

const MEDIA_NAME_PART =
  /(^|[-_/.:])(image|dall-e|flux|stable-diffusion|ideogram|recraft|video|veo|sora|kling|runway|seedance|wan\d|tts|speech|voice|eleven|music|sound-effect|sfx|suno|embed\w*|whisper|transcri\w*|stt)(?=[-_/.:]|\d|$)/i;

/** A catalog model's generated media type. Explicit provider metadata takes precedence over its id. */
export function catalogMatchesKind(
  model: string,
  facts: { outputModalities?: readonly string[] } | undefined,
  kind: ConnectionPickerKind,
): boolean {
  if (kind === "all") return true;
  if (kind === "decision") return true;
  // Whole name parts only, so "Sparkling" or "mattshumer" stay text models.
  if (kind === "chat")
    return facts?.outputModalities?.length
      ? !/embed/i.test(model) && facts.outputModalities.some((output) => output.toLowerCase() === "text")
      : !MEDIA_NAME_PART.test(model);
  if (facts?.outputModalities?.length)
    return facts.outputModalities.some(
      (output) => output.toLowerCase() === kind || (kind === "audio" && output.toLowerCase() === "speech"),
    );
  // ponytail: names are only a fallback when the provider omits output modalities; a provider catalog with
  // structured model types is the upgrade path for ambiguous names and speech-to-text models.
  const id = model.toLowerCase();
  if (kind === "image") return /image|dall-e|flux|stable-diffusion|ideogram|recraft/.test(id);
  if (kind === "video") return /video|veo|sora|kling|runway|seedance|wan\d/.test(id);
  return (
    /tts|speech|voice|eleven|music|sound-effect|sfx|suno/.test(id) && !/whisper|transcri|speech-to-text|stt/.test(id)
  );
}

type FlagJob = Job & { key: JobKey } & Required<Pick<Job, "kind" | "flag" | "fallback">>;
/** Jobs set by a row flag with a fallback flag: a default and a fallback picker each. */
export const FLAG_JOBS = JOBS.filter((job): job is FlagJob => !!job.fallback);
/** The flag jobs a Connection can be set for, by its kind. */
export const rowJobs = (row: Pick<ConnectionModelRow, "provider">) =>
  FLAG_JOBS.filter((job) => matchesKind(row, job.kind));

/** The Add window's kind filter for a job, if it has one. */
export const jobAddKind = (key: JobKey) => {
  const kind = JOB[key].kind;
  return kind ? ADD_KIND[kind] : undefined;
};

/**
 * The audio row Text to speech uses, in the server's order (tts.routes.ts): the row the Voice job saved in the TTS
 * settings (`useFollowVoiceJob`); only when none is saved, as in settings from before the Voice job, the audio
 * default. `missing` when the saved row is gone or not audio — the server then fails.
 */
export function voiceRowOf<R extends Pick<ConnectionModelRow, "id" | "provider" | "defaultForAgents">>(
  rows: readonly R[],
  cardId?: string | null,
) {
  const id = cardId?.trim();
  if (id) {
    const row = rows.find((row) => row.id === id && row.provider === "audio") ?? null;
    return { row, missing: !row };
  }
  const row = rows.find((row) => row.provider === "audio" && isConnectionFlagTrue(row.defaultForAgents)) ?? null;
  return { row, missing: false };
}

type VoiceRow = Pick<ConnectionModelRow, "id" | "provider" | "defaultForAgents" | "model"> & {
  baseUrl?: string | null;
  audioSource?: string | null;
  audioVoice?: string | null;
};

/**
 * Settings from before the Voice job: text to speech on with no saved row speaks with the audio default. Saves that
 * row as the Voice job's with the voice the server picks for it today (tts.routes.ts `resolveAudioConfig`), so the
 * job is the only source and the voice stays the same. A custom address or model the server filled into the row's
 * blank field goes onto the row (`row`), as a saved row no longer reads them. Null when there is nothing to move.
 */
export function voiceJobMigration(
  config: TTSConfig,
  rows: readonly VoiceRow[],
): { config: TTSConfig; row?: { id: string; baseUrl?: string; model?: string } } | null {
  if (!config.enabled || config.connectionId.trim()) return null;
  // Built-in PocketTTS needs no row; it was picked in the Voice job, so keep it.
  if (config.source === "pockettts") return null;
  const { row } = voiceRowOf(rows, "");
  if (!row) return null;
  const own = config.connectionProfiles?.[row.id];
  if (own) return { config: { ...config, ...own, connectionId: row.id } };
  const source = (row.audioSource ?? "elevenlabs") as TTSSource;
  const profile = source === config.source ? config : config.sourceProfiles?.[source];
  const carry = (field: "baseUrl" | "model") => {
    const value = profile?.[field];
    return !row[field]?.trim() && value && value !== TTS_SOURCE_DEFAULTS[source][field] ? { [field]: value } : {};
  };
  const patch = { ...carry("baseUrl"), ...carry("model") };
  // Only the voice came from the row's source; every other setting was the top-level one.
  return {
    config: { ...config, voice: row.audioVoice || profile?.voice || "", connectionId: row.id },
    ...(Object.keys(patch).length > 0 && { row: { id: row.id, ...patch } }),
  };
}

/** Built-in sources the Voice job offers: Local PocketTTS, and each direct source with its own key or server. */
export function voiceSources(config: TTSConfig): TTSSource[] {
  return TTS_SOURCES.filter((source) => {
    if (source === "pockettts") return true;
    const profile = source === config.source && !config.connectionId.trim() ? config : config.sourceProfiles?.[source];
    return !!profile?.apiKey || (!!profile?.baseUrl && profile.baseUrl !== TTS_SOURCE_DEFAULTS[source].baseUrl);
  });
}

type Catalog = { name: string; provider: string; models: readonly RemoteConnectionModel[] };

/**
 * What an empty job could use in the accounts' catalogs: how many models, and in which accounts. `drives` says whether
 * an account's provider can make that kind of media (`mediaSources`).
 */
export function foundForJob(
  job: Job,
  catalogs: readonly Catalog[],
  drives: (provider: string, kind: MediaKind) => boolean,
) {
  const embedding = (model: RemoteConnectionModel) => /embed/i.test(model.id);
  const fits = (provider: string, model: RemoteConnectionModel) => {
    if (job.key === "decision") return isChatProvider(provider) && !!model.capabilities?.logprobs;
    if (job.key === "embeddings") return isChatProvider(provider) && embedding(model);
    if (job.kind === "chat") return isChatProvider(provider) && catalogMatchesKind(model.id, model, "chat");
    const kind = job.kind as MediaKind | undefined;
    return !!kind && drives(provider, kind) && catalogMatchesKind(model.id, model, kind);
  };
  const hits = catalogs
    .map((catalog) => ({
      name: catalog.name,
      count: catalog.models.filter((model) => fits(catalog.provider, model)).length,
    }))
    .filter((hit) => hit.count > 0);
  return { count: hits.reduce((sum, hit) => sum + hit.count, 0), accounts: hits.map((hit) => hit.name) };
}
