// ──────────────────────────────────────────────
// Connection jobs — every job a Model can do, in display order. The Defaults box, the Add
// window's "For a job" list, the pickers and the model-row role badges all read this one table,
// so a new job or a changed rule is one edit here.
// ──────────────────────────────────────────────
import {
  AudioLines,
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
import { isChatProvider, type ConnectionPickerKind, type FeatureModelConnections } from "@marinara-engine/shared";
import type { AddKind } from "./add-connection";
import type { ConnectionModelRow } from "./connection-groups";

type Job = {
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
  /** What answers while the feature is unset. */
  follows?: "agents" | "main" | "sidecar" | "off";
  /** A device service (Voice, Dictation) set up on its own screen. */
  device?: "tts" | "stt";
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
    follows: "main",
    add: false,
  },
  { key: "mari", icon: GraduationCap, group: "omnibar", kind: "chat", feature: "mariConnectionId", follows: "agents" },
  {
    key: "quick",
    icon: MessageCircleQuestion,
    group: "omnibar",
    kind: "chat",
    feature: "omnibarAsideConnectionId",
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
  {
    key: "audio",
    icon: AudioLines,
    group: "media",
    kind: "audio",
    flag: "defaultForAgents",
    fallback: "fallbackForAgents",
  },
  { key: "voice", icon: Volume2, group: "media", device: "tts", terms: "tts" },
  { key: "stt", icon: Mic, group: "media", device: "stt", add: "search", terms: "stt whisper" },
  { key: "decision", icon: BrainCircuit, group: "background", kind: "decision", flag: "defaultForAgents" },
  { key: "embeddings", icon: Database, group: "background", kind: "chat" },
  { key: "vision", icon: Eye, group: "background", kind: "chat", feature: "visionConnectionId", follows: "off" },
] as const satisfies readonly Job[];

export type JobKey = (typeof JOB_LIST)[number]["key"];
export const JOBS: readonly (Job & { key: JobKey })[] = JOB_LIST;
export const JOB = Object.fromEntries(JOBS.map((job) => [job.key, job])) as Record<JobKey, Job & { key: JobKey }>;

export const jobLabelKey = (job: Job) =>
  job.feature ? `connections.defaults.feature.${job.feature}` : `connections.defaults.role.${job.key}`;
/** One plain line that says what the job does. */
export const jobHintKey = (job: Job) => `connections.defaults.about.${job.feature ?? job.key}`;

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
  audio: "audio",
  decision: "decision",
  all: undefined,
};

export function matchesKind(row: Pick<ConnectionModelRow, "provider">, kind: ConnectionPickerKind) {
  if (kind === "all") return true;
  return kind === "chat" ? isChatProvider(row.provider) : row.provider === KIND_PROVIDER[kind];
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
