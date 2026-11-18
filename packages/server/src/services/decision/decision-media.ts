/**
 * Pictures and clips from the chat, for decision models that can read them.
 *
 * A decision state is text that any decision backend may receive, including a hosted
 * one. Media ride beside it under a symbol rather than inside it: `JSON.stringify`
 * drops symbol keys, so a backend that cannot read media, or a remote connection, never
 * sees them, and nothing is loaded until a backend that reads them asks. Only Marinara's
 * own decision models on loopback ever do.
 *
 * Nothing is sent unless the author asked for it: a `decision:` statement with
 * `pictures:N` or `clips:N`, or an agent whose trigger question says how many. The
 * request then carries that many of the newest ones, and a model that cannot read them
 * still gets the text alone. Each reference loads lazily, so a gate pays nothing for
 * pictures it was not asked to look at.
 */
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  MAX_DECISION_CLIPS,
  MAX_DECISION_PICTURES,
  type DecisionInputKind,
  type DecisionRuntimeKind,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";
import { getSharp } from "../../utils/sharp.js";
import { parseExtra, type PromptAttachment } from "../generation/prompt-attachments.js";

export type DecisionMediaKind = Exclude<DecisionInputKind, "text">;

export interface DecisionMediaRef {
  kind: DecisionMediaKind;
  /** The media as a data URL, or null when it is gone or cannot be read. */
  load: () => Promise<string | null>;
}

const DECISION_MEDIA = Symbol.for("marinara.decision.media");

/**
 * The most media one request may carry, newest first. A picture is scaled so its longer
 * side is at most `imageEdge`: on Liquid d1 a full 1280 px picture cost 5,400 tokens and
 * 170 s on a 4-core processor, the same picture at 512 px 550 tokens and 17 s, with the
 * same answers. One clip, because Valen reads a clip as several pictures.
 */
export const DECISION_MEDIA_LIMITS = {
  images: MAX_DECISION_PICTURES,
  videos: MAX_DECISION_CLIPS,
  imageEdge: 512,
  /** Valen's SDK refuses an inline clip over 64 MiB; scene clips are a few megabytes. */
  videoBytes: 48 * 1024 * 1024,
  /** Pictures above this are not decoded at all. */
  imageBytes: 24 * 1024 * 1024,
} as const;

/** How many of the newest pictures and clips a request asks for. Zero of each by default. */
export interface DecisionMediaWant {
  pictures: number;
  clips: number;
}

export const NO_DECISION_MEDIA: DecisionMediaWant = { pictures: 0, clips: 0 };

/** Within the limits, so an imported or hand-edited setting can never ask for more. */
export function clampDecisionMediaWant(want: Partial<DecisionMediaWant> | undefined): DecisionMediaWant {
  const clamp = (value: unknown, max: number) =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
  return {
    pictures: clamp(want?.pictures, DECISION_MEDIA_LIMITS.images),
    clips: clamp(want?.clips, DECISION_MEDIA_LIMITS.videos),
  };
}

export const wantsDecisionMedia = (want: DecisionMediaWant | undefined) =>
  !!want && (want.pictures > 0 || want.clips > 0);

/** Groups requests: statements that want the same media share one request. */
export const decisionMediaKey = (want: DecisionMediaWant | undefined) => `${want?.pictures ?? 0}:${want?.clips ?? 0}`;

interface AttachedMedia {
  refs: DecisionMediaRef[];
  want: DecisionMediaWant;
  /**
   * Pictures the decision is about rather than the chat's, sent first and always: a
   * picture Marinara just made, or one it is choosing between. Data URLs.
   */
  subjects?: string[];
}

/** The most pictures a decision about given pictures carries. */
export const MAX_DECISION_SUBJECT_PICTURES = 4;

/**
 * Attach media references to a state, kept by spreads and dropped by JSON. Nothing is
 * attached when the request asks for no media, so a state built without asking never
 * carries any.
 */
export function attachDecisionMedia<T extends object>(
  state: T,
  refs: DecisionMediaRef[],
  want: DecisionMediaWant = NO_DECISION_MEDIA,
): T {
  const wanted = clampDecisionMediaWant(want);
  const kept = refs.filter((ref) => (ref.kind === "image" ? wanted.pictures > 0 : wanted.clips > 0));
  if (kept.length > 0)
    Object.defineProperty(state, DECISION_MEDIA, {
      value: { refs: kept, want: wanted } satisfies AttachedMedia,
      enumerable: true,
      configurable: true,
    });
  return state;
}

/**
 * Attach the pictures a decision is about, such as one Marinara just generated. They
 * reach only a model that reads pictures, like the chat's, and never a hosted backend.
 */
export function attachDecisionPictures<T extends object>(state: T, pictures: string[]): T {
  const subjects = pictures.filter((url) => url.startsWith("data:image/")).slice(0, MAX_DECISION_SUBJECT_PICTURES);
  if (subjects.length === 0) return state;
  const current = attachedOf(state);
  Object.defineProperty(state, DECISION_MEDIA, {
    value: { refs: current?.refs ?? [], want: current?.want ?? NO_DECISION_MEDIA, subjects } satisfies AttachedMedia,
    enumerable: true,
    configurable: true,
  });
  return state;
}

function attachedOf(state: unknown): AttachedMedia | null {
  if (!state || typeof state !== "object") return null;
  const attached = (state as Record<symbol, unknown>)[DECISION_MEDIA] as AttachedMedia | undefined;
  return attached && Array.isArray(attached.refs) ? attached : null;
}

/**
 * Whether one of the newest `within` messages carries a picture or clip of the kind the
 * decision looks at (any kind when it asks for neither). A decision that waits for one
 * is not asked on a turn without, so a picture check does not run every turn.
 */
export function hasRecentDecisionMedia(
  messages: ReadonlyArray<{ media?: DecisionMediaRef[] }>,
  within: number,
  want: Partial<DecisionMediaWant> | undefined,
): boolean {
  const pictures = (want?.pictures ?? 0) > 0;
  const clips = (want?.clips ?? 0) > 0;
  const counts = (ref: DecisionMediaRef) => (!pictures && !clips) || (ref.kind === "image" ? pictures : clips);
  return messages.slice(-Math.max(1, within)).some((message) => (message.media ?? []).some(counts));
}

export function decisionMediaOf(state: unknown): DecisionMediaRef[] {
  return attachedOf(state)?.refs ?? [];
}

export function decisionMediaWantOf(state: unknown): DecisionMediaWant {
  return attachedOf(state)?.want ?? NO_DECISION_MEDIA;
}

const SCENE_VIDEOS_DIR = join(DATA_DIR, "game-scene-videos");
const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

async function readAsDataUrl(path: string, mime: string, limit: number): Promise<string | null> {
  try {
    if ((await stat(path)).size > limit) return null;
    return `data:${mime};base64,${(await readFile(path)).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The media a chat message carries, as references: pictures the user attached, pictures
 * saved to the chat's gallery (selfies and illustrations), and generated clips.
 */
export function decisionMediaForMessage(
  message: { extra?: unknown },
  context: { chatId: string; galleryImagePath: (galleryId: string) => Promise<string | null> },
): DecisionMediaRef[] {
  const raw = parseExtra(message.extra).attachments;
  if (!Array.isArray(raw)) return [];
  const refs: DecisionMediaRef[] = [];
  for (const attachment of raw as PromptAttachment[]) {
    if (!attachment || typeof attachment !== "object") continue;
    const type = typeof attachment.type === "string" ? attachment.type : "";
    if (type.startsWith("image/") && typeof attachment.data === "string" && attachment.data.startsWith("data:image/")) {
      const data = attachment.data;
      refs.push({ kind: "image", load: async () => data });
    } else if (type === "image" && attachment.galleryId) {
      const galleryId = attachment.galleryId;
      refs.push({
        kind: "image",
        load: async () => {
          const path = await context.galleryImagePath(galleryId);
          const mime = path ? IMAGE_MIME[extname(path).slice(1).toLowerCase()] : undefined;
          return path && mime ? readAsDataUrl(path, mime, DECISION_MEDIA_LIMITS.imageBytes) : null;
        },
      });
    } else if (type === "video" && typeof attachment.filename === "string") {
      const filename = attachment.filename;
      refs.push({
        kind: "video",
        load: async () => {
          if (!/^[A-Za-z0-9_-]+\.mp4$/u.test(filename)) return null;
          try {
            const path = assertInsideDir(SCENE_VIDEOS_DIR, join(SCENE_VIDEOS_DIR, context.chatId, filename));
            return readAsDataUrl(path, "video/mp4", DECISION_MEDIA_LIMITS.videoBytes);
          } catch {
            return null;
          }
        },
      });
    }
  }
  return refs;
}

/** A picture scaled down to the decision limit, as a JPEG data URL; null when it cannot be read. */
async function scaleImage(dataUrl: string): Promise<string | null> {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.slice(0, comma).endsWith(";base64")) return null;
  const sharp = await getSharp();
  if (!sharp) return null;
  try {
    const input = Buffer.from(dataUrl.slice(comma + 1), "base64");
    if (input.byteLength > DECISION_MEDIA_LIMITS.imageBytes) return null;
    const edge = DECISION_MEDIA_LIMITS.imageEdge;
    const output = await sharp(input, { animated: false })
      .rotate()
      .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${output.toString("base64")}`;
  } catch {
    return null;
  }
}

export interface LoadedDecisionMedia {
  images: string[];
  videos: string[];
}

/**
 * Load the newest media the request asked for and the model reads, oldest first in the
 * result so they keep the chat's order. Anything that fails to load is left out; a gate
 * never fails because a picture went missing.
 */
export async function loadDecisionMedia(
  state: unknown,
  accepts: readonly DecisionInputKind[] | undefined,
): Promise<LoadedDecisionMedia> {
  const refs = decisionMediaOf(state);
  const want = decisionMediaWantOf(state);
  // The pictures the decision is about come first, then the chat's newest.
  const subjects: string[] = [];
  if (accepts?.includes("image"))
    for (const url of attachedOf(state)?.subjects ?? []) {
      const scaled = await scaleImage(url);
      if (scaled) subjects.push(scaled);
    }
  const maxImages = accepts?.includes("image") ? want.pictures : 0;
  const maxVideos = accepts?.includes("video") ? want.clips : 0;
  const wantImages = maxImages > 0;
  const wantVideos = maxVideos > 0;
  const images: string[] = [];
  const videos: string[] = [];
  if (refs.length === 0 || (!wantImages && !wantVideos)) return { images: subjects, videos };
  for (const ref of [...refs].reverse()) {
    if (ref.kind === "image" && images.length < maxImages) {
      const raw = await ref.load().catch(() => null);
      const scaled = raw ? await scaleImage(raw) : null;
      if (scaled) images.unshift(scaled);
    } else if (ref.kind === "video" && videos.length < maxVideos) {
      const clip = await ref.load().catch(() => null);
      if (clip) videos.unshift(clip);
    }
    if (images.length >= maxImages && videos.length >= maxVideos) break;
  }
  if (refs.length > 0 && images.length + videos.length === 0)
    logger.debug("[decision] The chat's media could not be read for the decision model");
  return { images: [...subjects, ...images], videos };
}

/**
 * The request a runtime wants for a state with media.
 *
 * - llama.cpp's native decision server (Liquid d1): the state as it is, pictures in a
 *   top-level `images` list.
 * - Winnow: pictures in its `winnow.images` extension.
 * - Valen (both forms): the state as one user message whose parts are the state's JSON
 *   text, then each picture and clip, the chat-message state Valen's API documents.
 */
export function decisionRequestWithMedia(
  runtime: DecisionRuntimeKind | undefined,
  state: unknown,
  media: LoadedDecisionMedia,
): { state: unknown; extraBody?: Record<string, unknown> } {
  if (media.images.length === 0 && media.videos.length === 0) return { state };
  if (runtime === "valen_gguf" || runtime === "valen_onnx") {
    return {
      state: {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: typeof state === "string" ? state : JSON.stringify(state) },
              ...media.images.map((url) => ({ type: "image_url", image_url: { url } })),
              ...media.videos.map((url) => ({ type: "video_url", video_url: { url } })),
            ],
          },
        ],
      },
    };
  }
  if (runtime === "winnow_cuda") return { state, extraBody: { winnow: { images: media.images } } };
  if (runtime === "llama_systemone") return { state, extraBody: { images: media.images } };
  return { state };
}

/**
 * What one picture and one clip cost in a model's input, in tokens, so a scene that
 * carries them leaves room for them and never runs past the model's limit (which is an
 * error, not a cut). At 512 px: about 550 tokens a picture on Liquid d1 and 180 on
 * Valen, measured 2026-11-18; Winnow's is not measured, so it gets d1's. A Valen clip
 * read 460. Generous on each. Zero for what the model does not read.
 */
export function decisionMediaTokens(
  runtime: DecisionRuntimeKind | undefined,
  inputs: readonly DecisionInputKind[] | undefined,
): { picture: number; clip: number } {
  const valen = runtime === "valen_gguf" || runtime === "valen_onnx";
  return {
    picture: inputs?.includes("image") ? (valen ? 250 : 650) : 0,
    clip: inputs?.includes("video") ? 700 : 0,
  };
}

/** The scene length the panel quotes a reading time for: a few turns of roleplay. */
export const DECISION_SPEED_SCENE_TOKENS = 2_000;

/**
 * How long a model takes here, in seconds, from the reading speed it was timed at on
 * this computer: a scene of a few turns, and, for a model that reads them, one picture
 * and one clip. Estimates from the same token costs the request limits use.
 */
export function decisionSpeedEstimate(
  model: { runtime?: DecisionRuntimeKind; inputs?: readonly DecisionInputKind[] },
  msPerToken: number | null,
): { sceneSeconds: number; pictureSeconds?: number; clipSeconds?: number } | null {
  if (msPerToken === null || !(msPerToken > 0)) return null;
  const valen = model.runtime === "valen_gguf" || model.runtime === "valen_onnx";
  const seconds = (ms: number) => Math.max(0.1, Math.round(ms / 100) / 10);
  return {
    sceneSeconds: seconds(msPerToken * DECISION_SPEED_SCENE_TOKENS),
    // Reading a picture also runs its vision encoder: on d1 a 512 px picture (550 tokens)
    // took about 1.5 times its tokens' reading time, measured 2026-11-18.
    ...(model.inputs?.includes("image") ? { pictureSeconds: seconds(msPerToken * (valen ? 180 : 550) * 1.5) } : {}),
    // Four frames, plus decoding them.
    ...(model.inputs?.includes("video") ? { clipSeconds: seconds(msPerToken * 460 * 1.5 + 1_000) } : {}),
  };
}
